import { AddSourceForm } from "@/components/AddSourceForm";

export default function NewSourcePage() {
  return (
    <>
      <div className="page-head">
        <h1>Add source</h1>
        <p>
          Drop in the link and paste the transcript. Research runs after you
          save and open the source.
        </p>
      </div>
      <AddSourceForm />
    </>
  );
}
