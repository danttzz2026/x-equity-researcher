import { AddSourceForm } from "@/components/AddSourceForm";

export default function NewSourcePage() {
  return (
    <>
      <div className="page-head">
        <h1>Add source</h1>
        <p>
          Bring an interview, podcast, or article. Save the source material,
          then start research when you’re ready.
        </p>
      </div>
      <AddSourceForm />
    </>
  );
}
