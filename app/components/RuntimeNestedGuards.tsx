"use client";
import {createContext} from 'react';
import type {NavigationGuard} from './useRuntimeExit';
export const RuntimeNestedGuards=createContext<((element:HTMLElement,guard:NavigationGuard)=>()=>void)|null>(null);
