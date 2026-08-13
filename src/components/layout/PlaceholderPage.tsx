import { AppShell } from "@/components/layout/AppShell";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

type PlaceholderPageProps = {
  title: string;
  description: string;
  icon: string;
  activeHref: string;
};

export function PlaceholderPage({
  title,
  description,
  icon,
  activeHref,
}: PlaceholderPageProps) {
  return (
    <AppShell activeHref={activeHref}>
      <section className="tonal-elevation-1 mx-auto max-w-2xl rounded-3xl border border-outline-variant bg-surface-container-lowest p-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-fixed">
          <MaterialIcon className="text-3xl text-primary" filled name={icon} />
        </div>
        <h1 className="mb-2 text-headline-xl font-extrabold text-[#173A67]">
          {title}
        </h1>
        <p className="text-body-md text-on-surface-variant">{description}</p>
      </section>
    </AppShell>
  );
}
