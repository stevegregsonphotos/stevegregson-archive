import { revalidatePath } from "next/cache";

export function revalidateProductionContent(
  slug?: string,
) {
  revalidatePath("/");
  revalidatePath("/production");
  revalidatePath("/archive");
  revalidatePath("/sitemap.xml");

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
