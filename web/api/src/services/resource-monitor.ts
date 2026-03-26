import si from 'systeminformation';
import { docker, prisma } from '../index.js';

export interface SystemResources {
  host: {
    cpuUsagePercent: number;
    cpuCores: number;
    memoryTotalMB: number;
    memoryUsedMB: number;
    memoryUsagePercent: number;
    diskTotalGB: number;
    diskUsedGB: number;
    diskUsagePercent: number;
    uptime: number;
  };
  docker: {
    totalContainers: number;
    runningContainers: number;
    sessionContainers: number;
    runningSessionContainers: number;
  };
  capacity: {
    availableSessionSlots: number;
    estimatedMaxSessions: number;
  };
}

const SESSION_MEMORY_LIMIT_MB = parseInt(process.env['SESSION_MEMORY_LIMIT'] || '268435456', 10) / (1024 * 1024);
const MEMORY_RESERVE_MB = 512; // Reserve for host OS + API server

/**
 * Get full system resource stats
 */
export async function getSystemResources(): Promise<SystemResources> {
  const [cpuLoad, mem, disk, dockerInfo, sessionContainers] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    getDockerInfo(),
    getSessionContainerCount(),
  ]);

  // Use the main disk
  const mainDisk = disk.find((d) => d.mount === '/') || disk[0];
  const diskTotalGB = mainDisk ? mainDisk.size / (1024 * 1024 * 1024) : 0;
  const diskUsedGB = mainDisk ? mainDisk.used / (1024 * 1024 * 1024) : 0;

  const memoryTotalMB = mem.total / (1024 * 1024);
  const memoryUsedMB = mem.active / (1024 * 1024);
  const memoryAvailableMB = memoryTotalMB - memoryUsedMB - MEMORY_RESERVE_MB;
  const estimatedMaxSessions = Math.max(0, Math.floor(memoryAvailableMB / SESSION_MEMORY_LIMIT_MB));

  return {
    host: {
      cpuUsagePercent: Math.round(cpuLoad.currentLoad * 100) / 100,
      cpuCores: cpuLoad.cpus.length,
      memoryTotalMB: Math.round(memoryTotalMB),
      memoryUsedMB: Math.round(memoryUsedMB),
      memoryUsagePercent: Math.round((memoryUsedMB / memoryTotalMB) * 10000) / 100,
      diskTotalGB: Math.round(diskTotalGB * 100) / 100,
      diskUsedGB: Math.round(diskUsedGB * 100) / 100,
      diskUsagePercent: mainDisk ? Math.round(mainDisk.use * 100) / 100 : 0,
      uptime: si.time().uptime || 0,
    },
    docker: {
      totalContainers: dockerInfo.totalContainers,
      runningContainers: dockerInfo.runningContainers,
      sessionContainers: sessionContainers.total,
      runningSessionContainers: sessionContainers.running,
    },
    capacity: {
      availableSessionSlots: estimatedMaxSessions - sessionContainers.running,
      estimatedMaxSessions,
    },
  };
}

/**
 * Get Docker engine info
 */
async function getDockerInfo(): Promise<{
  totalContainers: number;
  runningContainers: number;
}> {
  try {
    const info = await docker.info();
    return {
      totalContainers: info.Containers || 0,
      runningContainers: info.ContainersRunning || 0,
    };
  } catch {
    return { totalContainers: 0, runningContainers: 0 };
  }
}

/**
 * Get session container count from DB
 */
async function getSessionContainerCount(): Promise<{ total: number; running: number }> {
  const [total, running] = await Promise.all([
    prisma.session.count({ where: { status: { not: 'DELETED' } } }),
    prisma.session.count({ where: { status: 'RUNNING' } }),
  ]);
  return { total, running };
}
