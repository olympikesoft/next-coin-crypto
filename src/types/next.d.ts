/* eslint-disable @typescript-eslint/ban-types */
// types/next.d.ts
import { NextPage } from 'next';

declare module 'next' {
  export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
    layout?: string;
  };
}
