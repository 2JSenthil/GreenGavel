type SourceCardProps = {
  number: number;
  body: string;
  date: string;
  page: number;
};

export default function SourceCard({
  number,
  body,
  date,
  page,
}: SourceCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="font-semibold">
        [{number}] {body}
      </h3>

      <p className="mt-1 text-sm text-gray-500">
        {date} · Page {page}
      </p>

      <span className="mt-2 block text-sm text-blue-600">
        PDF link coming soon
      </span>
    </div>
  );
}