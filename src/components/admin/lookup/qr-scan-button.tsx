"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

/**
 * Scan the QR sticker on the airframe.
 *
 * **It is absent where it cannot work, never broken.** `BarcodeDetector` is a
 * Chromium API: it exists in Chrome and Edge on Android, Windows and macOS, and
 * does not exist in Firefox or in Safari at all. A control that is *there* and
 * does nothing when pressed is worse than one that is not there — an officer in
 * a field presses it, nothing happens, and they conclude the tool is broken
 * rather than that they should type the code. So the button renders only after
 * feature detection has actually succeeded, and the input beside it is the
 * primary path in every browser.
 *
 * **Detection goes through `useSyncExternalStore`, not an effect.** The browser
 * is an external system and this is a snapshot of it, so the hook takes a
 * server snapshot of `false` and a client snapshot of whatever the browser
 * actually has — the server renders no button, the client renders the real
 * answer, and there is no hydration mismatch and no `setState` in an effect
 * body (which the React compiler's lint rejects, correctly, as a cascading
 * render).
 *
 * The camera stream is stopped on every exit path — success, failure, cancel
 * and unmount. A page that leaves the camera light on after answering the
 * question is a page nobody will open twice.
 */

/** The shape we use, declared locally: TypeScript's DOM lib does not ship it. */
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorConstructor = new (options: {
  formats: string[];
}) => BarcodeDetectorLike;

function barcodeDetector(): BarcodeDetectorConstructor | null {
  const candidate = (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector;
  return typeof candidate === "function"
    ? (candidate as BarcodeDetectorConstructor)
    : null;
}

/**
 * Whether this browser can do it at all. A capability, not a subscription —
 * nothing ever changes it mid-session, so `subscribe` is a no-op that returns
 * an unsubscribe doing nothing.
 */
function subscribeNever(): () => void {
  return () => {};
}

function scanSupported(): boolean {
  return (
    barcodeDetector() !== null &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

/** The server has no camera and no BarcodeDetector, so: no button. */
function scanUnsupportedOnServer(): boolean {
  return false;
}

/** How often a frame is examined. 8/s is well inside a phone's budget. */
const FRAME_INTERVAL_MS = 125;

export function QrScanButton({
  onScan,
  disabled = false,
}: {
  /** Whatever the QR carried — a URL or a bare code. Normalised by the server. */
  onScan: (value: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("lookup");

  const supported = useSyncExternalStore(
    subscribeNever,
    scanSupported,
    scanUnsupportedOnServer,
  );
  const [scanning, setScanning] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Unmount is one of the exit paths, and the easiest one to forget.
  useEffect(() => {
    return () => stopStream(streamRef);
  }, []);

  useEffect(() => {
    if (!scanning) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function run() {
      const Detector = barcodeDetector();
      if (!Detector) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // The rear camera, which is the one pointed at the aircraft.
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const detector = new Detector({ formats: ["qr_code"] });
        timer = setInterval(async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const found = await detector.detect(videoRef.current);
            const first = found[0]?.rawValue?.trim();
            if (first) {
              cancelled = true;
              stopStream(streamRef);
              setScanning(false);
              onScan(first);
            }
          } catch {
            // A single frame that would not decode is not an error worth
            // reporting; the next one is 125 ms away.
          }
        }, FRAME_INTERVAL_MS);
      } catch {
        /**
         * Permission refused, or no camera. A refusal the officer can read and
         * act on — by typing the code into the box that is already on screen.
         */
        setProblem(t("scanDenied"));
        setScanning(false);
        stopStream(streamRef);
      }
    }

    void run();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stopStream(streamRef);
    };
  }, [scanning, onScan, t]);

  if (!supported) return null;

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        /* A field control, one-handed, in sunlight. `min-h-12` is the tap
           target; the label is never an icon alone. */
        className="min-h-12"
        onClick={() => {
          setProblem(null);
          setScanning((open) => !open);
        }}
      >
        {scanning ? t("scanStop") : t("scanStart")}
      </Button>

      {problem ? (
        <p className="text-destructive text-sm" role="alert">
          {problem}
        </p>
      ) : null}

      {/*
        Kept mounted only while scanning: a `<video>` with a live stream behind
        `hidden` still holds the camera. `playsInline` stops iOS taking the
        video full-screen — harmless here, since Safari has no BarcodeDetector
        and never reaches this branch, but it is one line and it stops the next
        browser that ships one from behaving badly.
      */}
      {scanning ? (
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label={t("scanViewfinder")}
          className="border-border max-h-64 w-full rounded-lg border object-cover"
        />
      ) : null}
    </div>
  );
}

function stopStream(ref: { current: MediaStream | null }) {
  ref.current?.getTracks().forEach((track) => track.stop());
  ref.current = null;
}
