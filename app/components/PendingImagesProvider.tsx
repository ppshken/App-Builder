"use client";
import {createContext,useContext} from 'react';
import type {PendingImages} from '@/lib/pending-images';
export const PendingImagesContext=createContext<PendingImages|null>(null);
export const usePendingImages=()=>useContext(PendingImagesContext);
export function usePendingImagePreview(src:string){return usePendingImages()?.preview(src)||src;}
