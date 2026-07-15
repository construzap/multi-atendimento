# syntax=docker/dockerfile:1

FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY app ./app
COPY server ./server
COPY shared ./shared
COPY public ./public
COPY nuxt.config.ts tailwind.config.js tsconfig.json ./

ARG SUPABASE_URL
ARG SUPABASE_KEY
ARG NUXT_PUBLIC_PUSHER_APP_ID
ARG NUXT_PUBLIC_PUSHER_KEY
ARG NUXT_PUBLIC_PUSHER_CLUSTER

ENV SUPABASE_URL=$SUPABASE_URL
ENV SUPABASE_KEY=$SUPABASE_KEY
ENV NUXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
ENV NUXT_PUBLIC_SUPABASE_KEY=$SUPABASE_KEY
ENV NUXT_PUBLIC_PUSHER_APP_ID=$NUXT_PUBLIC_PUSHER_APP_ID
ENV NUXT_PUBLIC_PUSHER_KEY=$NUXT_PUBLIC_PUSHER_KEY
ENV NUXT_PUBLIC_PUSHER_CLUSTER=$NUXT_PUBLIC_PUSHER_CLUSTER

RUN npm run build

FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000

COPY --from=build /app/.output ./.output

# SheetJS (`xlsx`) resolve `./dist/cpexcel.js` em runtime via `/app/node_modules`.
# O Nitro não empacota esse arquivo no `.output` — sem isso, SSR (F5 em /produtos etc.) dá 500.
COPY --from=build /app/node_modules/xlsx ./node_modules/xlsx
COPY --from=build /app/node_modules/codepage ./node_modules/codepage
COPY --from=build /app/node_modules/cfb ./node_modules/cfb
COPY --from=build /app/node_modules/ssf ./node_modules/ssf
COPY --from=build /app/node_modules/wmf ./node_modules/wmf
COPY --from=build /app/node_modules/frac ./node_modules/frac
COPY --from=build /app/node_modules/adler-32 ./node_modules/adler-32
COPY --from=build /app/node_modules/crc-32 ./node_modules/crc-32
COPY --from=build /app/node_modules/word ./node_modules/word

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
