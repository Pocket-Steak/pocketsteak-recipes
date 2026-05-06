"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { captureScreenshot } from "@/lib/captureScreenshot";
const MIN_FEEDBACK_LENGTH = 3;
const MAX_FEEDBACK_LENGTH = 1000;
const SUCCESS_MESSAGE = "Thanks! Pocket Steak has your feedback on the grill.";
const EMPTY_MESSAGE = "Please describe the issue before submitting.";
const ERROR_MESSAGE = "Something went wrong. Please try again.";
const CLOSE_DELAY_MS = 1600;
function validateFeedback(value) {
    const trimmed = value.trim();
    if (!trimmed) {
        return EMPTY_MESSAGE;
    }
    if (trimmed.length < MIN_FEEDBACK_LENGTH) {
        return `Feedback must be at least ${MIN_FEEDBACK_LENGTH} characters.`;
    }
    if (trimmed.length > MAX_FEEDBACK_LENGTH) {
        return `Feedback must be ${MAX_FEEDBACK_LENGTH.toLocaleString()} characters or fewer.`;
    }
    return null;
}
function getScreenSize() {
    if (typeof window === "undefined") {
        return "unknown";
    }
    return `${window.screen.width}x${window.screen.height}`;
}
export function SendFeedbackButton({ appName, endpointUrl = "/api/send-feedback" }) {
    const [isOpen, setIsOpen] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [errorMessage, setErrorMessage] = useState(null);
    const [submissionState, setSubmissionState] = useState("idle");
    const [isDesktop, setIsDesktop] = useState(true);
    const closeTimeoutRef = useRef(null);
    const characterCount = useMemo(() => feedback.length, [feedback]);
    const isSubmitting = submissionState === "sending";
    const isLocked = submissionState === "sending" || submissionState === "success";
    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        const mediaQuery = window.matchMedia("(min-width: 1024px)");
        const updateLayoutMode = (event) => {
            setIsDesktop(event ? event.matches : mediaQuery.matches);
        };
        updateLayoutMode();
        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", updateLayoutMode);
            return () => {
                mediaQuery.removeEventListener("change", updateLayoutMode);
            };
        }
        mediaQuery.addListener(updateLayoutMode);
        return () => {
            mediaQuery.removeListener(updateLayoutMode);
        };
    }, []);
    useEffect(() => {
        return () => {
            if (closeTimeoutRef.current) {
                window.clearTimeout(closeTimeoutRef.current);
            }
        };
    }, []);
    const resetForm = useCallback(() => {
        setFeedback("");
        setErrorMessage(null);
        setSubmissionState("idle");
    }, []);
    const openModal = useCallback(() => {
        resetForm();
        setIsOpen(true);
    }, [resetForm]);
    const closeModal = useCallback(() => {
        if (submissionState === "sending") {
            return;
        }
        if (closeTimeoutRef.current) {
            window.clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
        resetForm();
        setIsOpen(false);
    }, [resetForm, submissionState]);
    useEffect(() => {
        if (!isOpen) {
            return;
        }
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const handleKeyDown = (event) => {
            if (event.key === "Escape" && !isSubmitting) {
                closeModal();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [closeModal, isOpen, isSubmitting]);
    async function handleSubmit(event) {
        event.preventDefault();
        const validationError = validateFeedback(feedback);
        if (validationError) {
            setErrorMessage(validationError);
            setSubmissionState("idle");
            return;
        }
        setErrorMessage(null);
        setSubmissionState("sending");
        const trimmedFeedback = feedback.trim();
        let screenshot = null;
        try {
            screenshot = await captureScreenshot();
        }
        catch {
            screenshot = null;
        }
        const payload = {
            appName,
            feedback: trimmedFeedback,
            pageUrl: window.location.href,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            screenSize: getScreenSize(),
            screenshot,
        };
        try {
            const response = await fetch(endpointUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });
            const result = (await response.json().catch(() => null));
            if (!response.ok || !result?.ok) {
                throw new Error(result?.error || ERROR_MESSAGE);
            }
            setSubmissionState("success");
            setErrorMessage(SUCCESS_MESSAGE);
            closeTimeoutRef.current = window.setTimeout(() => {
                closeModal();
            }, CLOSE_DELAY_MS);
        }
        catch {
            setSubmissionState("error");
            setErrorMessage(ERROR_MESSAGE);
        }
    }
    const floatingButtonBottom = isDesktop ? 24 : 96;
    return (<>
      <button aria-controls="send-feedback-modal" aria-expanded={isOpen} data-feedback-widget="true" onClick={openModal} style={{
            background: "rgba(17, 24, 39, 0.94)",
            border: "1px solid rgba(148, 163, 184, 0.28)",
            borderRadius: 10,
            bottom: `calc(${floatingButtonBottom}px + env(safe-area-inset-bottom))`,
            boxShadow: "0 14px 40px rgba(15, 23, 42, 0.28)",
            color: "#f8fafc",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 0,
            lineHeight: 1,
            padding: "0.9rem 1rem",
            position: "fixed",
            right: 16,
            zIndex: 60,
        }} type="button">
        Send Feedback
      </button>

      {isOpen ? (<div aria-labelledby="send-feedback-title" aria-modal="true" data-feedback-widget="true" id="send-feedback-modal" onClick={(event) => {
                if (event.target === event.currentTarget && !isSubmitting) {
                    closeModal();
                }
            }} role="dialog" style={{
                alignItems: "center",
                background: "rgba(15, 23, 42, 0.72)",
                display: "flex",
                inset: 0,
                justifyContent: "center",
                padding: 16,
                position: "fixed",
                zIndex: 70,
            }}>
          <div style={{
                background: "#ffffff",
                border: "1px solid rgba(148, 163, 184, 0.24)",
                borderRadius: 12,
                boxShadow: "0 30px 80px rgba(15, 23, 42, 0.28)",
                color: "#111827",
                maxWidth: 560,
                padding: 20,
                width: "100%",
            }}>
            <div style={{ marginBottom: 16 }}>
              <h2 id="send-feedback-title" style={{
                fontSize: 20,
                fontWeight: 650,
                letterSpacing: 0,
                lineHeight: 1.2,
                margin: 0,
            }}>
                Send Feedback
              </h2>
            </div>

            <form onSubmit={handleSubmit}>
              <label htmlFor="feedback-text" style={{
                color: "#1f2937",
                display: "block",
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 8,
            }}>
                What happened or what would you like to share?
              </label>

              <textarea autoFocus disabled={isLocked} id="feedback-text" maxLength={MAX_FEEDBACK_LENGTH} onChange={(event) => {
                setFeedback(event.target.value);
                if (errorMessage && submissionState !== "success") {
                    setErrorMessage(null);
                    setSubmissionState("idle");
                }
            }} placeholder="Type your feedback here..." rows={6} style={{
                background: "#ffffff",
                border: "1px solid rgba(148, 163, 184, 0.5)",
                borderRadius: 10,
                color: "#111827",
                cursor: isLocked ? "not-allowed" : "text",
                fontFamily: "inherit",
                fontSize: 14,
                lineHeight: 1.5,
                minHeight: 144,
                opacity: isLocked ? 0.72 : 1,
                outline: "none",
                padding: "0.85rem 0.95rem",
                resize: "vertical",
                width: "100%",
            }} value={feedback}/>

              <div style={{
                color: "#6b7280",
                display: "flex",
                fontSize: 12,
                justifyContent: "space-between",
                marginTop: 8,
            }}>
                <span>We&apos;ll include the page details automatically.</span>
                <span>{characterCount}/{MAX_FEEDBACK_LENGTH}</span>
              </div>

              {errorMessage ? (<p style={{
                    color: submissionState === "success" ? "#166534" : "#b91c1c",
                    fontSize: 14,
                    lineHeight: 1.5,
                    margin: "12px 0 0",
                }}>
                  {errorMessage}
                </p>) : null}

              <div style={{
                display: "flex",
                gap: 12,
                justifyContent: "flex-end",
                marginTop: 20,
            }}>
                <button onClick={closeModal} style={{
                background: "#ffffff",
                border: "1px solid rgba(148, 163, 184, 0.5)",
                borderRadius: 10,
                color: "#1f2937",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 600,
                opacity: isSubmitting ? 0.7 : 1,
                padding: "0.8rem 1rem",
            }} type="button">
                  Cancel
                </button>

                <button disabled={isLocked} style={{
                background: "#111827",
                border: "1px solid #111827",
                borderRadius: 10,
                color: "#f9fafb",
                cursor: isLocked ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 600,
                opacity: isLocked ? 0.7 : 1,
                padding: "0.8rem 1rem",
            }} type="submit">
                  {submissionState === "sending" ? "Sending..." : submissionState === "success" ? "Sent" : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>) : null}
    </>);
}
