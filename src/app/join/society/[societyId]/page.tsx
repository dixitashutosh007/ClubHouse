'use client';

import React, { Suspense, use } from 'react';
import { JoinSocietyForm } from '../../_components/JoinSocietyForm';

type JoinParams = Promise<{ societyId: string }>;

// Joining a society picked in the search after SMS sign-in (no invite code needed)
export default function JoinSocietyByIdPage({ params }: { params: JoinParams }) {
  return (
    <Suspense fallback={null}>
      <JoinFromSearch params={params} />
    </Suspense>
  );
}

function JoinFromSearch({ params }: { params: JoinParams }) {
  const { societyId } = use(params);
  return <JoinSocietyForm target={{ societyId }} />;
}
