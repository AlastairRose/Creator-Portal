"use client";

import { useRouter } from "next/navigation";
import type { ModelInfoAnswers } from "@/lib/onboarding/state";
import { saveMyModelInfo } from "@/lib/actions/onboarding";
import ModelInfoForm from "./ModelInfoForm";

export default function MyInfoForm({ initial }: { initial: ModelInfoAnswers }) {
  const router = useRouter();
  return (
    <ModelInfoForm
      initial={initial}
      submitLabel="Save my info"
      onSave={async (answers) => {
        const { error } = await saveMyModelInfo(answers);
        if (!error) router.refresh();
        return error;
      }}
    />
  );
}
