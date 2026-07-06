import { Suspense } from "react";
import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Join Techblob to comment and submit videos.",
};

export default function SignupPage() {
  return (
    <main className="mx-auto max-w-md px-3 py-10 sm:px-4">
      <h1 className="text-2xl font-black tracking-tight">Create Account</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Join Techblob to comment and submit videos. Free, no spam.
      </p>
      <div className="mt-6">
        {/* useSearchParams (the ?next= redirect) requires a Suspense boundary */}
        <Suspense fallback={null}>
          <AuthForm mode="signup" />
        </Suspense>
      </div>
    </main>
  );
}
