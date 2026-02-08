/**
 * Location: frontend/src/features/marketing/api.ts
 * Purpose: React Query hooks for fetching CMS marketing content
 * Why: Centralized data fetching with caching for marketing content
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@lib/apiClient";
import type { HomepageContent, AboutPageContent } from "./types";

const CMS_KEYS = {
    homepage: ["cms", "homepage"] as const,
    about: ["cms", "about"] as const,
};

const fetchHomepageContent = async (): Promise<HomepageContent> =>
    apiClient<HomepageContent>("/cms/homepage-content");

const fetchAboutPageContent = async (): Promise<AboutPageContent> =>
    apiClient<AboutPageContent>("/cms/about-page-content");

export function useHomepageContentQuery() {
    return useQuery({
        queryKey: CMS_KEYS.homepage,
        queryFn: fetchHomepageContent,
        staleTime: 1000 * 60 * 60,
    });
}

export function useAboutPageContentQuery() {
    return useQuery({
        queryKey: CMS_KEYS.about,
        queryFn: fetchAboutPageContent,
        staleTime: 1000 * 60 * 60,
    });
}
