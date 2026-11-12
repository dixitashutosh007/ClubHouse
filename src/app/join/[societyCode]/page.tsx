'use client';

import React, { Suspense, use } from 'react';
import { JoinSocietyForm } from '../_components/JoinSocietyForm';

type JoinParams = Promise<{ societyCode: string }>;

// Joining from an invite link. The code is only known at request time, so the
// form renders inside Suspense.
export default function JoinSocietyPage({ params }: { params: JoinParams }) {
  return (
    <Suspense fallback={null}>
      <JoinFromLink params={params} />
    </Suspense>
  );
}

function JoinFromLink({ params }: { params: JoinParams }) {
  const { societyCode } = use(params);
  return <JoinSocietyForm target={{ societyCode }} />;
}
