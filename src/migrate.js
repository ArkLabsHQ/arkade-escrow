import "reflect-metadata";
import AppDataSource from "../src/data-source";

async function main() {
	await AppDataSource.initialize();
	const res = await AppDataSource.runMigrations();
	console.log(
		"Ran migrations:",
		res.map((m) => m.name),
	);
	await AppDataSource.destroy();
}

main().catch(async (err) => {
	console.error(err);
	try {
		await AppDataSource.destroy();
	} catch {}
	process.exit(1);
});
