import prisma from '../../../db/prisma.js';

export class CopytradeV2Projector {
  async rebuildOrderSummaryView(): Promise<{ processed: number }> {
    // Projection is currently read-time materialization.
    // This method is a placeholder hook for future materialized views.
    const processed = await prisma.copytradeOrder.count();
    return { processed };
  }
}
