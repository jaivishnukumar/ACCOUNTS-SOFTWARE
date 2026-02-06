export const downloadBlob = (blob, fileName) => {
    // Create a URL for the blob
    const url = window.URL.createObjectURL(blob);

    // Create a temporary anchor element
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;

    // Append to the body (required for Chrome to trigger download)
    document.body.appendChild(link);

    // Programmatically click the link
    link.click();

    // Clean up: remove the link and revoke the URL
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};
