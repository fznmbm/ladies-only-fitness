import type { Metadata } from "next";
import { groupBySlug } from "@/lib/joinableGroup";
import { joinMetadata } from "@/lib/config";
import { JoinScreen } from "../JoinScreen";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    sent?: string;
    problem?: string;
    name?: string;
    phone?: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return joinMetadata((await groupBySlug(slug))?.name);
}

/** The short join link, e.g. /join/livefitclub-7a3f. */
export default async function ShortJoinPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { sent, problem, name, phone } = await searchParams;
  return (
    <JoinScreen
      group={await groupBySlug(slug)}
      slug={slug}
      sent={sent}
      problem={problem}
      name={name}
      phone={phone}
    />
  );
}
