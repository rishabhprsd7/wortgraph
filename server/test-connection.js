import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
dotenv.config();

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

try {
  await driver.verifyConnectivity();
  console.log('✓ Connected to Neo4j Aura successfully');
  const session = driver.session();
  const result = await session.run('RETURN "WortGraph ready" AS msg');
  console.log(result.records[0].get('msg'));
  await session.close();
} catch (e) {
  console.error('✗ Connection failed:', e.message);
} finally {
  await driver.close();
}
