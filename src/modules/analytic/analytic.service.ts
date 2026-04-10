import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { sign } from 'jsonwebtoken';

type GoogleServiceAccount = {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
};

type GoogleAnalyticsMetricValue = {
  value?: string;
};

type GoogleAnalyticsDimensionValue = {
  value?: string;
};

type GoogleAnalyticsRow = {
  dimensionValues?: GoogleAnalyticsDimensionValue[];
  metricValues?: GoogleAnalyticsMetricValue[];
};

type GoogleAnalyticsRunReportResponse = {
  rows?: GoogleAnalyticsRow[];
};

@Injectable()
export class AnalyticService {
  private static readonly ANALYTICS_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
  private static readonly DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';
  private static readonly ACCESS_TOKEN_GRACE_MS = 60 * 1000;

  private accessTokenCache?: {
    token: string;
    expiresAt: number;
  };

  async getOverview(days = 30) {
    const normalizedDays = this.normalizeDays(days);

    const summaryReport = await this.runReport({
      dateRanges: [{ startDate: `${normalizedDays}daysAgo`, endDate: 'today' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'newUsers' },
      ],
    });

    const seriesReport = await this.runReport({
      dateRanges: [{ startDate: `${normalizedDays}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    });

    const summaryRow = summaryReport.rows?.[0];

    return {
      propertyId: this.getPropertyId(),
      days: normalizedDays,
      summary: {
        activeUsers: this.toMetricNumber(summaryRow?.metricValues?.[0]?.value),
        sessions: this.toMetricNumber(summaryRow?.metricValues?.[1]?.value),
        screenPageViews: this.toMetricNumber(summaryRow?.metricValues?.[2]?.value),
        newUsers: this.toMetricNumber(summaryRow?.metricValues?.[3]?.value),
      },
      series:
        seriesReport.rows?.map((row) => ({
          date: this.toIsoDate(row.dimensionValues?.[0]?.value),
          activeUsers: this.toMetricNumber(row.metricValues?.[0]?.value),
          sessions: this.toMetricNumber(row.metricValues?.[1]?.value),
          screenPageViews: this.toMetricNumber(row.metricValues?.[2]?.value),
        })) ?? [],
    };
  }

  async getTopPages(days = 30, limit = 10) {
    const normalizedDays = this.normalizeDays(days);
    const normalizedLimit = this.normalizeLimit(limit);

    const report = await this.runReport({
      dateRanges: [{ startDate: `${normalizedDays}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'pageTitle' }, { name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: normalizedLimit,
    });

    return {
      propertyId: this.getPropertyId(),
      days: normalizedDays,
      limit: normalizedLimit,
      items:
        report.rows?.map((row) => ({
          pageTitle: row.dimensionValues?.[0]?.value ?? '',
          pagePath: row.dimensionValues?.[1]?.value ?? '',
          screenPageViews: this.toMetricNumber(row.metricValues?.[0]?.value),
          activeUsers: this.toMetricNumber(row.metricValues?.[1]?.value),
        })) ?? [],
    };
  }

  async getCountries(days = 30, limit = 10) {
    const normalizedDays = this.normalizeDays(days);
    const normalizedLimit = this.normalizeLimit(limit);

    const report = await this.runReport({
      dateRanges: [{ startDate: `${normalizedDays}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: normalizedLimit,
    });

    return {
      propertyId: this.getPropertyId(),
      days: normalizedDays,
      limit: normalizedLimit,
      items:
        report.rows?.map((row) => ({
          country: row.dimensionValues?.[0]?.value ?? 'Unknown',
          sessions: this.toMetricNumber(row.metricValues?.[0]?.value),
          activeUsers: this.toMetricNumber(row.metricValues?.[1]?.value),
          screenPageViews: this.toMetricNumber(row.metricValues?.[2]?.value),
        })) ?? [],
    };
  }

  async getDevices(days = 30, limit = 10) {
    const normalizedDays = this.normalizeDays(days);
    const normalizedLimit = this.normalizeLimit(limit);

    const report = await this.runReport({
      dateRanges: [{ startDate: `${normalizedDays}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: normalizedLimit,
    });

    return {
      propertyId: this.getPropertyId(),
      days: normalizedDays,
      limit: normalizedLimit,
      items:
        report.rows?.map((row) => ({
          device: row.dimensionValues?.[0]?.value ?? 'Unknown',
          sessions: this.toMetricNumber(row.metricValues?.[0]?.value),
          activeUsers: this.toMetricNumber(row.metricValues?.[1]?.value),
          screenPageViews: this.toMetricNumber(row.metricValues?.[2]?.value),
        })) ?? [],
    };
  }

  async getBrowsers(days = 30, limit = 10) {
    const normalizedDays = this.normalizeDays(days);
    const normalizedLimit = this.normalizeLimit(limit);

    const report = await this.runReport({
      dateRanges: [{ startDate: `${normalizedDays}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'browser' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: normalizedLimit,
    });

    return {
      propertyId: this.getPropertyId(),
      days: normalizedDays,
      limit: normalizedLimit,
      items:
        report.rows?.map((row) => ({
          browser: row.dimensionValues?.[0]?.value ?? 'Unknown',
          sessions: this.toMetricNumber(row.metricValues?.[0]?.value),
          activeUsers: this.toMetricNumber(row.metricValues?.[1]?.value),
          screenPageViews: this.toMetricNumber(row.metricValues?.[2]?.value),
        })) ?? [],
    };
  }

  async getOperatingSystems(days = 30, limit = 10) {
    const normalizedDays = this.normalizeDays(days);
    const normalizedLimit = this.normalizeLimit(limit);

    const report = await this.runReport({
      dateRanges: [{ startDate: `${normalizedDays}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'operatingSystem' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: normalizedLimit,
    });

    return {
      propertyId: this.getPropertyId(),
      days: normalizedDays,
      limit: normalizedLimit,
      items:
        report.rows?.map((row) => ({
          operatingSystem: row.dimensionValues?.[0]?.value ?? 'Unknown',
          sessions: this.toMetricNumber(row.metricValues?.[0]?.value),
          activeUsers: this.toMetricNumber(row.metricValues?.[1]?.value),
          screenPageViews: this.toMetricNumber(row.metricValues?.[2]?.value),
        })) ?? [],
    };
  }

  async getScreenResolutions(days = 30, limit = 10) {
    const normalizedDays = this.normalizeDays(days);
    const normalizedLimit = this.normalizeLimit(limit);

    const report = await this.runReport({
      dateRanges: [{ startDate: `${normalizedDays}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'screenResolution' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: normalizedLimit,
    });

    return {
      propertyId: this.getPropertyId(),
      days: normalizedDays,
      limit: normalizedLimit,
      items:
        report.rows?.map((row) => ({
          screenResolution: row.dimensionValues?.[0]?.value ?? 'Unknown',
          sessions: this.toMetricNumber(row.metricValues?.[0]?.value),
          activeUsers: this.toMetricNumber(row.metricValues?.[1]?.value),
          screenPageViews: this.toMetricNumber(row.metricValues?.[2]?.value),
        })) ?? [],
    };
  }

  async getTrafficSources(days = 30, limit = 10) {
    const normalizedDays = this.normalizeDays(days);
    const normalizedLimit = this.normalizeLimit(limit);

    const report = await this.runReport({
      dateRanges: [{ startDate: `${normalizedDays}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }, { name: 'sessionSourceMedium' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: normalizedLimit,
    });

    return {
      propertyId: this.getPropertyId(),
      days: normalizedDays,
      limit: normalizedLimit,
      items:
        report.rows?.map((row) => ({
          channelGroup: row.dimensionValues?.[0]?.value ?? 'Unknown',
          sourceMedium: row.dimensionValues?.[1]?.value ?? 'Unknown',
          sessions: this.toMetricNumber(row.metricValues?.[0]?.value),
          activeUsers: this.toMetricNumber(row.metricValues?.[1]?.value),
          screenPageViews: this.toMetricNumber(row.metricValues?.[2]?.value),
        })) ?? [],
    };
  }

  async getTechOverview(days = 30, limit = 10) {
    const normalizedDays = this.normalizeDays(days);
    const normalizedLimit = this.normalizeLimit(limit);

    const [overview, devices, browsers, operatingSystems, screenResolutions] = await Promise.all([
      this.getOverview(normalizedDays),
      this.getDevices(normalizedDays, normalizedLimit),
      this.getBrowsers(normalizedDays, normalizedLimit),
      this.getOperatingSystems(normalizedDays, normalizedLimit),
      this.getScreenResolutions(normalizedDays, normalizedLimit),
    ]);

    return {
      propertyId: this.getPropertyId(),
      days: normalizedDays,
      limit: normalizedLimit,
      summary: overview.summary,
      series: overview.series,
      devices: devices.items,
      browsers: browsers.items,
      operatingSystems: operatingSystems.items,
      screenResolutions: screenResolutions.items,
    };
  }

  private async runReport(body: Record<string, unknown>): Promise<GoogleAnalyticsRunReportResponse> {
    const propertyId = this.getPropertyId();
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        (payload as { error?: { message?: string }; message?: string })?.error?.message ||
        (payload as { message?: string })?.message ||
        'Google Analytics request failed';
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }

    return payload as GoogleAnalyticsRunReportResponse;
  }

  private async getAccessToken(): Promise<string> {
    const cachedToken = this.accessTokenCache;
    if (cachedToken && cachedToken.expiresAt > Date.now() + AnalyticService.ACCESS_TOKEN_GRACE_MS) {
      return cachedToken.token;
    }

    const credentials = await this.loadCredentials();
    const tokenUri = credentials.token_uri || AnalyticService.DEFAULT_TOKEN_URI;
    const now = Math.floor(Date.now() / 1000);

    // Google accepts a signed JWT assertion from the service account.
    const assertion = sign(
      {
        iss: credentials.client_email,
        scope: AnalyticService.ANALYTICS_SCOPE,
        aud: tokenUri,
        iat: now,
        exp: now + 3600,
      },
      credentials.private_key,
      { algorithm: 'RS256' },
    );

    const response = await fetch(tokenUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !(payload as { access_token?: string }).access_token) {
      const message =
        (payload as { error_description?: string; error?: string; message?: string }).error_description ||
        (payload as { error?: string }).error ||
        (payload as { message?: string }).message ||
        'Failed to get Google access token';
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }

    this.accessTokenCache = {
      token: (payload as { access_token: string }).access_token,
      expiresAt: Date.now() + Number((payload as { expires_in?: number }).expires_in || 3600) * 1000,
    };

    return (payload as { access_token: string }).access_token;
  }

  private async loadCredentials(): Promise<Required<GoogleServiceAccount>> {
    const credentialsPath = this.getCredentialsPath();
    const raw = await fs.readFile(credentialsPath, 'utf8').catch(() => {
      throw new HttpException(
        `Google Analytics credentials file not found: ${credentialsPath}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    });

    const parsed = JSON.parse(raw) as GoogleServiceAccount;

    if (!parsed.client_email || !parsed.private_key) {
      throw new HttpException(
        'Google Analytics credentials file is missing client_email or private_key',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
      token_uri: parsed.token_uri || AnalyticService.DEFAULT_TOKEN_URI,
    };
  }

  private getCredentialsPath(): string {
    const configuredPath =
      process.env.GOOGLE_ANALYTICS_CREDENTIALS_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!configuredPath) {
      throw new HttpException(
        'GOOGLE_ANALYTICS_CREDENTIALS_PATH or GOOGLE_APPLICATION_CREDENTIALS is required',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return configuredPath;
  }

  private getPropertyId(): string {
    const propertyId = process.env.GA4_PROPERTY_ID?.trim();

    if (!propertyId) {
      throw new HttpException('GA4_PROPERTY_ID is required', HttpStatus.SERVICE_UNAVAILABLE);
    }

    return propertyId;
  }

  private normalizeDays(days: number): number {
    const normalized = Math.trunc(Number(days) || 30);
    return Math.min(Math.max(normalized, 1), 365);
  }

  private normalizeLimit(limit: number): number {
    const normalized = Math.trunc(Number(limit) || 10);
    return Math.min(Math.max(normalized, 1), 50);
  }

  private toMetricNumber(value?: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toIsoDate(value?: string): string | null {
    if (!value || value.length !== 8) {
      return null;
    }

    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
}
