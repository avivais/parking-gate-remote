/* Israeli phone number utilities */

export const ISRAEL_PHONE_PREFIXES = [
    { label: "050", value: "050" },
    { label: "051", value: "051" },
    { label: "052", value: "052" },
    { label: "053", value: "053" },
    { label: "054", value: "054" },
    { label: "055", value: "055" },
    { label: "058", value: "058" },
    { label: "059", value: "059" },
    { label: "02", value: "02" },
    { label: "03", value: "03" },
    { label: "04", value: "04" },
    { label: "08", value: "08" },
    { label: "09", value: "09" },
];

/**
 * Parse a phone number in format 0XXXXXXXXX into prefix and number parts
 * @param phone - Phone number in format 0XXXXXXXXX (9-10 characters)
 * @returns Object with prefix and number, or empty strings if parsing fails
 */
export function parsePhone(phone: string): { prefix: string; number: string } {
    if (!phone || typeof phone !== "string") {
        return { prefix: "", number: "" };
    }

    // Remove any spaces or dashes
    const cleaned = phone.replace(/[\s-]/g, "");

    // Must start with 0
    if (!cleaned.startsWith("0")) {
        return { prefix: "", number: "" };
    }

    // Try mobile prefixes first (050-059)
    if (cleaned.length >= 3 && cleaned.startsWith("05")) {
        const prefix = cleaned.substring(0, 3);
        const number = cleaned.substring(3);
        // Validate mobile prefix
        if (["050", "051", "052", "053", "054", "055", "058", "059"].includes(prefix)) {
            return { prefix, number };
        }
    }

    // Try landline prefixes (02, 03, 04, 08, 09)
    if (cleaned.length >= 2) {
        const prefix = cleaned.substring(0, 2);
        const number = cleaned.substring(2);
        // Validate landline prefix
        if (["02", "03", "04", "08", "09"].includes(prefix)) {
            return { prefix, number };
        }
    }

    return { prefix: "", number: "" };
}

/**
 * Validate phone number based on prefix type
 * @param prefix - Phone prefix (e.g., "050", "02")
 * @param number - Remaining digits after prefix
 * @returns true if valid, false otherwise
 */
export function validatePhoneNumber(prefix: string, number: string): boolean {
    if (!prefix || !number) {
        return false;
    }

    // Remove any non-digit characters
    const cleanedNumber = number.replace(/\D/g, "");

    // Mobile prefixes (05X): must be exactly 7 digits
    if (prefix.startsWith("05") && prefix.length === 3) {
        return cleanedNumber.length === 7;
    }

    // Landline prefixes (02/03/04/08/09): must be exactly 7 digits
    if (["02", "03", "04", "08", "09"].includes(prefix)) {
        return cleanedNumber.length === 7;
    }

    return false;
}

