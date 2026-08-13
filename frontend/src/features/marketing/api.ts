/**
 * Location: frontend/src/features/marketing/api.ts
 * Purpose: React Query hooks for fetching CMS marketing content
 * Why: Centralized data fetching with caching for marketing content
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@lib/apiClient";
import {
    getContactAttempt,
    resolveContactAttempt,
} from "./contactAttemptRegistry";
import type { ContactFormPayload } from "./contactForm";
import type {
    AboutPageContent,
    ContactPageContent,
    ContactSubmissionPayload,
    ContactSubmissionResponse,
    HomepageContent,
} from "./types";

const CMS_KEYS = {
    homepage: ["cms", "homepage"] as const,
    about: ["cms", "about"] as const,
    contact: ["cms", "contact"] as const,
};

const fetchHomepageContent = async (): Promise<HomepageContent> =>
    apiClient<HomepageContent>("/cms/homepage-content", { auth: "none" });

const fetchAboutPageContent = async (): Promise<AboutPageContent> =>
    apiClient<AboutPageContent>("/cms/about-page-content", { auth: "none" });

const fetchContactPageContent = async (): Promise<ContactPageContent> =>
    apiClient<ContactPageContent>("/cms/contact-page-content", { auth: "none" });

const submitContact = async (
    payload: ContactFormPayload,
): Promise<ContactSubmissionResponse> => {
    let attempt;
    try {
        attempt = await getContactAttempt(payload);
    } catch {
        throw new Error("Unable to prepare your message. Please try again.");
    }

    const response = await apiClient<ContactSubmissionResponse, ContactSubmissionPayload>("/contact", {
        method: "POST",
        body: { ...payload, idempotencyKey: attempt.idempotencyKey },
        auth: "none",
    });
    resolveContactAttempt(attempt.fingerprint);
    return response;
};

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

export function useContactPageContentQuery() {
    return useQuery({
        queryKey: CMS_KEYS.contact,
        queryFn: fetchContactPageContent,
        staleTime: 1000 * 60 * 60,
    });
}

export function useContactSubmissionMutation() {
    return useMutation({
        mutationKey: ["contact", "submission"],
        mutationFn: submitContact,
        // Key preparation and persistence are one serial lifecycle per form.
        scope: { id: "contact-submission" },
    });
}
