const apiBaseUrl =
	import.meta.env.VITE_API_BASE_URL || "http://localhost:3002/api";
const appRootUrl = import.meta.env.VITE_APP_ROOT_URL || "/backoffice";
const itemsPerPage = Number(import.meta.env.VITE_ITEMS_PER_PAGE ?? 10);

export default {
	apiBaseUrl,
	appRootUrl,
	itemsPerPage,
};
