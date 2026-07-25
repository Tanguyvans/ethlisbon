import CreateTokenForm from "@/components/CreateTokenForm";

export default function CreateTokenPage() {
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Create a token</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Backed by the Hedera Token Service. Every checkbox below maps directly to a native HTS
          key or feature — nothing here is a smart contract.
        </p>
      </div>
      <CreateTokenForm />
    </div>
  );
}
