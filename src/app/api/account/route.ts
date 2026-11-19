import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, clearSessionCookie, requireUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * DELETE /api/account — deletes the signed-in account. Comments, submitted videos, reports and blocks go with it
 * (ON DELETE CASCADE from users), and the session cookie is cleared.
 */
export async function DELETE() {
  try {
    const user = await requireUser();
    await prisma.user.delete({ where: { id: user.id } });
    clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[api/account] delete failed", err);
    return NextResponse.json({ error: "Couldn't delete the account. Email info@kavarollc.com." }, { status: 500 });
  }
}
