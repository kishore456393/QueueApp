import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-md border-border shadow-sm">
        <CardContent className="pt-6">
          <div className="mb-4 flex gap-3">
            <AlertCircle className="h-8 w-8 shrink-0 text-destructive" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Page not found</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                This URL is not registered in the app router.
              </p>
            </div>
          </div>

          <Link
            href="/"
            className={cn(buttonVariants(), "mt-4 inline-flex w-full sm:w-auto")}
          >
            Back to overview
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
