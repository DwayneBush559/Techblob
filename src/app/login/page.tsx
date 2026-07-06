import { Suspense } from "react";
import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to Techblob to comment and submit videos.",
};

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md px-3 py-10 sm:px-4">
      <h1 className="text-2xl font-black tracking-tight">Sign In</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Welcome back. Sign in to comment and submit videos.
      </p>
      <div className="mt-6">
        {/* useSearchParams (the ?next= redirect) requires a Suspense boundary */}
        <Suspense fallback={null}>
          <AuthForm mode="login" />
        </Suspense>
      </div>
    </main>
  );
}
