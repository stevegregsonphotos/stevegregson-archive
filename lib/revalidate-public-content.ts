import { revalidatePath } from "next/cache";

export function revalidateProductionContent(
  slug?: string,
) {
  revalidatePath("/");
  revalidatePath("/production");
  revalidatePath("/archive");
  revalidatePath("/sitemap.xml");
  // Pages whose counts and lists come from the archive.
  revalidatePath("/commissions");
  revalidatePath("/drama-school-photography");
  revalidatePath("/opera-photography");
  revalidatePath("/people");
  revalidatePath("/people/[slug]", "page");
  revalidatePath("/venues");
  revalidatePath("/venues/[slug]", "page");
  revalidatePath("/llms.txt");

  if (slug) {
    revalidatePath(
      `/productions/${slug}`,
    );
  }
}

export function revalidateSelectedWorkContent() {
  revalidatePath("/");
  revalidatePath("/selected-work");
  revalidatePath("/production");
  revalidatePath("/rehearsals");
  revalidatePath("/marketing-pr");
}
