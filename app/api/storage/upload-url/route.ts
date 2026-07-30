export async function POST() {
  return Response.json(
    {
      error: 'DIRECT_UPLOAD_DISABLED',
      message: 'Use the validated image upload endpoint.',
    },
    { status: 410 },
  )
}
