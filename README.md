This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
Deployed on Vercel.

## 今日进度（YYYY-MM-DD）
- 完成 Supabase 邮箱登录（magic link）
- 修复 auth callback 会话交换问题（兼容 code / 非 code 情况）
- 完成 /streak 云同步状态展示
- 完成“推送本地到云端”按钮逻辑
- Supabase 已建表：sessions / interrupts，并配置 RLS policy
- 当前状态：登录成功，推送成功（0 条/可正常返回成功提示）

## 下次继续（优先级）
1. 在 today / interrupt 页面写入 Supabase（不只本地）
2. 做“从云端拉取覆盖本地 / 合并”功能
3. 优化 /streak 页面去重与 UI
4. 部署到 Vercel 并验证生产环境登录回调