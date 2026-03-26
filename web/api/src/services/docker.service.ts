import { docker, prisma } from '../index.js';

const SESSION_IMAGE = process.env['SESSION_IMAGE'] || 'hanseol-web-session:latest';
const SESSION_NETWORK = process.env['SESSION_NETWORK'] || 'hanseol-web-network';
const SESSION_CPU_LIMIT = parseFloat(process.env['SESSION_CPU_LIMIT'] || '0.5');
const SESSION_MEMORY_LIMIT = parseInt(process.env['SESSION_MEMORY_LIMIT'] || '268435456', 10); // 256MB
const DASHBOARD_URL = process.env['DASHBOARD_URL'] || '';

/**
 * Find an available port atomically using a database transaction
 */
async function findAvailablePort(): Promise<number> {
  const port = await prisma.$transaction(async (tx) => {
    const usedPorts = await tx.session.findMany({
      where: { status: { in: ['CREATING', 'RUNNING'] }, containerPort: { not: null } },
      select: { containerPort: true },
    });
    const usedSet = new Set(usedPorts.map((s) => s.containerPort));
    const start = parseInt(process.env['SESSION_PORT_START'] || '10000', 10);
    for (let p = start; p < start + 10000; p++) {
      if (!usedSet.has(p)) return p;
    }
    throw new Error('No available ports for session container');
  });
  return port;
}

/**
 * Create and start a Docker container for a session
 */
export async function createSessionContainer(
  userId: string,
  sessionId: string,
  agentId: string | null
): Promise<{ containerId: string; containerPort: number }> {
  const port = await findAvailablePort();

  // Load agent config if specified
  let agentEnv: string[] = [];
  if (agentId) {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (agent) {
      agentEnv = [
        `AGENT_NAME=${agent.name}`,
        `AGENT_SYSTEM_PROMPT=${agent.systemPrompt || ''}`,
        `AGENT_ENABLED_TOOLS=${agent.enabledTools.join(',')}`,
      ];
    }
  }

  // Ensure Docker network exists
  try {
    await docker.getNetwork(SESSION_NETWORK).inspect();
  } catch {
    await docker.createNetwork({ Name: SESSION_NETWORK, Driver: 'bridge' });
  }

  const container = await docker.createContainer({
    Image: SESSION_IMAGE,
    name: `hanseol-session-${sessionId.slice(0, 8)}`,
    Labels: {
      'hanseol-web-session': 'true',
      'hanseol-session-id': sessionId,
      'hanseol-user-id': userId,
    },
    Env: [
      `SESSION_ID=${sessionId}`,
      `USER_ID=${userId}`,
      `DASHBOARD_URL=${DASHBOARD_URL}`,
      `SESSION_WS_PORT=3001`,
      ...agentEnv,
    ],
    ExposedPorts: { ['3001/tcp']: {} },
    HostConfig: {
      PortBindings: {
        ['3001/tcp']: [{ HostPort: String(port) }],
      },
      NanoCpus: Math.floor(SESSION_CPU_LIMIT * 1e9),
      Memory: SESSION_MEMORY_LIMIT,
      MemorySwap: SESSION_MEMORY_LIMIT * 2,
      NetworkMode: SESSION_NETWORK,
      RestartPolicy: { Name: 'unless-stopped' },
      Binds: [],
    },
  });

  await container.start();

  return {
    containerId: container.id,
    containerPort: port,
  };
}

/**
 * Start a stopped container
 */
export async function startContainer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  await container.start();
}

/**
 * Stop a running container
 */
export async function stopContainer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  await container.stop({ t: 10 });
}

/**
 * Remove a container
 */
export async function removeContainer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  await container.remove({ force: true });
}

/**
 * Get stats for a container
 */
export async function getContainerStats(
  containerId: string
): Promise<{ cpuPercent: number; memoryUsageMB: number; memoryLimitMB: number }> {
  const container = docker.getContainer(containerId);
  const stats = await container.stats({ stream: false });

  // Calculate CPU percentage
  const cpuDelta =
    stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta =
    stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuCount = stats.cpu_stats.online_cpus || 1;
  const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * cpuCount * 100 : 0;

  // Memory
  const memoryUsageMB = (stats.memory_stats.usage || 0) / (1024 * 1024);
  const memoryLimitMB = (stats.memory_stats.limit || 0) / (1024 * 1024);

  return {
    cpuPercent: Math.round(cpuPercent * 100) / 100,
    memoryUsageMB: Math.round(memoryUsageMB * 100) / 100,
    memoryLimitMB: Math.round(memoryLimitMB * 100) / 100,
  };
}

/**
 * List all session containers by label
 */
export async function listSessionContainers(): Promise<
  Array<{
    containerId: string;
    sessionId: string;
    userId: string;
    state: string;
    status: string;
  }>
> {
  const containers = await docker.listContainers({
    all: true,
    filters: { label: ['hanseol-web-session=true'] },
  });

  return containers.map((c) => ({
    containerId: c.Id,
    sessionId: c.Labels['hanseol-session-id'] || '',
    userId: c.Labels['hanseol-user-id'] || '',
    state: c.State,
    status: c.Status,
  }));
}

/**
 * Get the assigned WS port for a container
 */
export async function getContainerPort(containerId: string): Promise<number | null> {
  const container = docker.getContainer(containerId);
  const info = await container.inspect();
  const ports = info.NetworkSettings.Ports;

  for (const [, bindings] of Object.entries(ports)) {
    if (bindings && bindings.length > 0) {
      return parseInt(bindings[0].HostPort, 10);
    }
  }
  return null;
}
