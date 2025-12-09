const apiBaseUrl = import.meta.env.VITE_CLIENT_API_BASE_URL;
if (!apiBaseUrl) {
	throw new Error("VITE_CLIENT_API_BASE_URL is not defined");
}
const appRootUrl = import.meta.env.VITE_CLIENT_APP_ROOT_URL;
if (!appRootUrl) {
	throw new Error("VITE_CLIENT_APP_ROOT_URL is not defined");
}
const itemsPerPage = Number(import.meta.env.VITE_ITEMS_PER_PAGE);
if (!itemsPerPage || Number.isNaN(itemsPerPage)) {
	throw new Error("VITE_ITEMS_PER_PAGE is not defined");
}

export default {
	apiBaseUrl,
	appRootUrl,
	itemsPerPage,
};
