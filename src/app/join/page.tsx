import type { Metadata } from "next";
import { joinableGroup } from "@/lib/joinableGroup";
import { joinMetadata } from "@/lib/config";
import { JoinScreen } from "./JoinScreen";

export const dynamic = "force-dynamic";

type Params = {
  g?: string;
  code?: string;
  sent?: string;
  problem?: string;
  name?: string;
  phone?: string;
};

/**
 * The older, long join link: /join?g=…&code=…. It only works while JOIN_CODE
 * is set in Vercel and matches. Delete JOIN_CODE to switch old links off;
 * the short link (/join/livefitclub-…) doesn't use it.
 */
async function linkedGroup({ g = "", code = "" }: Params) {
  const needed = process.env.JOIN_CODE;
  if (!needed || code !== needed) return null;
  return joinableGroup(g);
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Params>;
}): Promise<Metadata> {
  return joinMetadata((await linkedGroup(await searchParams))?.name);
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  return <JoinScreen group={await linkedGroup(params)} {...params} />;
}
