import { CsvImport } from "@/components/csv-import";
import { PageHeader } from "@/components/ui/misc";
import { session } from "@/lib/server/page";

export const metadata = { title: "Import contacts" };

export default async function ImportPage() {
  await session();
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Import contacts" description="Columns are validated and every row is checked for duplicates before anything is saved. Consent is only recorded when your file says so." />
      <CsvImport />
    </div>
  );
}
