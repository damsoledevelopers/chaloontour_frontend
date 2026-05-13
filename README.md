# Chalo On Tour Frontend

Next.js frontend application for Chalo On Tour CRM system.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file (optional, defaults to localhost):
```
NEXT_PUBLIC_API_URL=https://crm.chaloontour.com/api
```

3. Run development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
npm start
```

## Deployment on Render

The `render.yaml` file is configured for automatic deployment on Render.

### Important Notes:

1. **Build Step**: The deployment includes `npm run build` which creates the `.next` directory required for `next start`
2. **Port Configuration**: The start script uses the `PORT` environment variable provided by Render
3. **Environment Variables**: Set `NEXT_PUBLIC_API_URL` in Render dashboard to point to your backend API

### Required Environment Variables:

- `NEXT_PUBLIC_API_URL` - Your backend API URL (e.g., `https://your-backend.onrender.com/api`)
- `NODE_ENV` - Set to `production` (automatically set by Render)

## Troubleshooting

If you see the error: `ENOENT: no such file or directory, open '.next/BUILD_ID'`

This means the build step didn't run. Make sure:
1. The `buildCommand` in `render.yaml` includes `npm run build`
2. The build completes successfully before `npm start` runs
3. Check Render build logs for any build errors

