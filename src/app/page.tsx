import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MEMBER_COOKIE } from "@/lib/memberAuth";

export const dynamic = "force-dynamic";

// The installed app always opens here, so it sends each person to the right place.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/sessions");
  if ((await cookies()).get(MEMBER_COOKIE)) redirect("/me");
  redirect("/login");
}
