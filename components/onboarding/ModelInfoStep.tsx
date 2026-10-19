"use client";

import { saveModelInfo } from "@/lib/actions/onboarding";
import ModelInfoForm from "./ModelInfoForm";

export default function ModelInfoStep({ creatorId, onDone }: { creatorId: string; onDone: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        This helps our chat team talk to your fans exactly like you would. If you have a persona, answer as that persona.
        Skip anything you&apos;d rather not answer, and you can change your answers any time under My Info.
      </p>
      <ModelInfoForm
        initial={{ fields: {}, lists: {} }}
        draftKey={`creator-portal:onboarding-model-info:${creatorId}`}
        submitLabel="Save and continue"
        onSave={async (answers) => {
          const { error } = await saveModelInfo(answers);
          if (!error) onDone();
          return error;
        }}
      />
    </div>
  );
}
