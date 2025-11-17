const apiBaseUrl =
	import.meta.env.VITE_API_BASE_URL || "http://localhost:3002/api/v1";
const appRootUrl = import.meta.env.VITE_APP_ROOT_URL || "/client";
const hostUrls: string[] = (
	import.meta.env.VITE_HOST_URL || "http://localhost:3003"
).split(",");
const itemsPerPage = Number(import.meta.env.VITE_ITEMS_PER_PAGE ?? 10);

export default {
	apiBaseUrl,
	appRootUrl,
	hostUrls,
	itemsPerPage,
};
