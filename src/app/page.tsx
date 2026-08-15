import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Wave 0 placeholder. F02 rewrites the layout for RTL and locale routing;
 * F16 replaces this with the real landing page.
 */
export default function Home() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Ajniha — project shell</CardTitle>
          <CardDescription>
            Wave 0 is in place: Next.js, Tailwind, shadcn/ui, ESLint conventions
            and Vitest. Nothing here is the real application yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button>Styled button</Button>
          <Button variant="outline">Outline</Button>
        </CardContent>
      </Card>
    </main>
  );
}
