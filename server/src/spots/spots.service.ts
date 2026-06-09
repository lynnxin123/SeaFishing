import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SPOT_BOAT_SELECT = {
  boatId: true,
  shipName: true,
  maxNum: true,
  shipLen: true,
  shipWid: true,
  score: true,
  sailCount: true,
  captain: true,
  captainAvatar: true,
  price: true,
  wharf: true,
  displayWharf: true,
  facilities: true,
  images: true,
} as const;

@Injectable()
export class SpotsService {
  private listCache: ReturnType<SpotsService['formatSpotSummary']>[] | null =
    null;
  private listCacheTs = 0;
  private readonly listCacheTtlMs = 5 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  invalidateListCache() {
    this.listCache = null;
    this.listCacheTs = 0;
  }

  async list() {
    const now = Date.now();
    if (this.listCache && now - this.listCacheTs < this.listCacheTtlMs) {
      return this.listCache;
    }
    const spots = await this.prisma.fishingSpot.findMany({
      where: { active: true },
      include: {
        boatLinks: {
          select: { boat: { select: { boatId: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
    this.listCache = spots.map((spot) => this.formatSpotSummary(spot));
    this.listCacheTs = now;
    return this.listCache;
  }

  async detail(spotKey: string) {
    const spot = await this.prisma.fishingSpot.findFirst({
      where: { spotKey, active: true },
      include: {
        boatLinks: {
          include: { boat: { select: SPOT_BOAT_SELECT } },
        },
      },
    });
    if (!spot) {
      throw new NotFoundException('钓点不存在');
    }
    return this.formatSpot(spot);
  }

  formatSpotSummary(spot: {
    spotKey: string;
    name: string;
    type: string;
    latitude: number;
    longitude: number;
    depth: string;
    fishSpecies: unknown;
    bestMonths: string;
    chargeType: string;
    priceNote: string;
    seaRange: string;
    windSensitive: boolean;
    eventId: number | null;
    eventTitle: string;
    boatLinks: Array<{ boat: { boatId: string } }>;
  }) {
    const fishSpecies = Array.isArray(spot.fishSpecies)
      ? (spot.fishSpecies as string[])
      : [];

    return {
      id: spot.spotKey,
      name: spot.name,
      type: spot.type,
      latitude: spot.latitude,
      longitude: spot.longitude,
      depth: spot.depth,
      fishSpecies,
      bestMonths: spot.bestMonths,
      chargeType: spot.chargeType,
      priceNote: spot.priceNote,
      seaRange: spot.seaRange,
      windSensitive: spot.windSensitive,
      eventId: spot.eventId,
      eventTitle: spot.eventTitle,
      ships: spot.boatLinks.map(({ boat }) => boat.boatId),
    };
  }

  formatSpot(spot: {
    spotKey: string;
    name: string;
    type: string;
    latitude: number;
    longitude: number;
    depth: string;
    fishSpecies: unknown;
    bestMonths: string;
    chargeType: string;
    priceNote: string;
    seaRange: string;
    windSensitive: boolean;
    eventId: number | null;
    eventTitle: string;
    boatLinks: Array<{ boat: {
      boatId: string;
      shipName: string;
      maxNum: number;
      shipLen: number | null;
      shipWid: number | null;
      score: number;
      sailCount: number;
      captain: string;
      captainAvatar: string;
      price: number;
      wharf: string;
      displayWharf: string;
      facilities: unknown;
      images: unknown;
    } }>;
  }) {
    const fishSpecies = Array.isArray(spot.fishSpecies)
      ? (spot.fishSpecies as string[])
      : [];
    const resolvedShips = spot.boatLinks.map(({ boat }) => this.toMiniShip(boat));

    return {
      id: spot.spotKey,
      name: spot.name,
      type: spot.type,
      latitude: spot.latitude,
      longitude: spot.longitude,
      depth: spot.depth,
      fishSpecies,
      bestMonths: spot.bestMonths,
      chargeType: spot.chargeType,
      priceNote: spot.priceNote,
      seaRange: spot.seaRange,
      windSensitive: spot.windSensitive,
      eventId: spot.eventId,
      eventTitle: spot.eventTitle,
      ships: spot.boatLinks.map(({ boat }) => boat.boatId),
      resolvedShips,
    };
  }

  private toMiniShip(boat: {
    boatId: string;
    shipName: string;
    maxNum: number;
    shipLen: number | null;
    shipWid: number | null;
    score: number;
    sailCount: number;
    captain: string;
    captainAvatar: string;
    price: number;
    wharf: string;
    displayWharf: string;
    facilities: unknown;
    images: unknown;
  }) {
    const images = Array.isArray(boat.images) ? (boat.images as string[]) : [];
    const facilities = Array.isArray(boat.facilities)
      ? (boat.facilities as string[])
      : [];

    return {
      shipKey: boat.boatId,
      shipName: boat.shipName,
      boatId: boat.boatId,
      maxNum: boat.maxNum,
      shipLen: boat.shipLen != null ? String(boat.shipLen) : '',
      shipWid: boat.shipWid != null ? String(boat.shipWid) : '',
      score: boat.score,
      sailCount: boat.sailCount,
      captain: boat.captain,
      captainAvatar: boat.captainAvatar,
      price: boat.price,
      images: images.length ? images : ['/images/boat1.jpg'],
      wharf: boat.wharf,
      displayWharf: boat.displayWharf,
      facilities,
    };
  }
}
