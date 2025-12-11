export const numberToWords = (num: number): string => {
    if (num === 0) return 'Zero Rupees';

    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const convertLessThanOneThousand = (n: number): string => {
        if (n === 0) return '';
        if (n < 10) return units[n];
        if (n < 20) return teens[n - 10];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + units[n % 10] : '');
        return units[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanOneThousand(n % 100) : '');
    };

    const convert = (n: number): string => {
        if (n === 0) return '';

        let result = '';

        // Crores
        if (Math.floor(n / 10000000) > 0) {
            result += convert(Math.floor(n / 10000000)) + ' Crore ';
            n %= 10000000;
        }

        // Lakhs
        if (Math.floor(n / 100000) > 0) {
            result += convertLessThanOneThousand(Math.floor(n / 100000)) + ' Lakh ';
            n %= 100000;
        }

        // Thousands
        if (Math.floor(n / 1000) > 0) {
            result += convertLessThanOneThousand(Math.floor(n / 1000)) + ' Thousand ';
            n %= 1000;
        }

        // Remaining
        if (n > 0) {
            result += convertLessThanOneThousand(n);
        }

        return result.trim();
    };

    const integerPart = Math.floor(num);
    // Round to 0 decimals for "Grand Total" as per request
    // The user requested grand total rounded up/ceiling, so we assume integer input largely, 
    // but if decimals exist we can handle paise or just ignore if it's rounded.
    // User said "Grand total is rounded up... no need to have decimal places". So we treat input as integer.

    return convert(integerPart) + ' Rupees Only';
};
