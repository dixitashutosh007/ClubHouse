import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, errorResponse } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return errorResponse('Unauthorized', 401);

  const body = await req.json().catch(() => ({}));
  const { filename, fileType } = body;

  const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
  const region = process.env.AWS_REGION || 'ap-south-1';

  // If S3 bucket is configured with credentials, generate S3 target
  const key = `societies/${auth.societyId}/lessons/${Date.now()}-${filename || 'photo.jpg'}`;

  if (bucket) {
    const uploadUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    return NextResponse.json({
      uploadUrl,
      publicUrl: uploadUrl,
      key,
    });
  }

  // Graceful fallback for environments where S3 bucket is not yet bound
  return NextResponse.json({
    uploadUrl: null,
    publicUrl: null,
    key,
    message: 'Direct upload active; image will be embedded directly.',
  });
}
