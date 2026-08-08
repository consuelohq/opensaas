export type LeadConnectorCustomMenu = {
  title: string;
  url: string;
  icon: { name: string; fontFamily: 'fab' | 'fas' | 'far' };
  showOnCompany: boolean;
  showOnLocation: boolean;
  showToAllLocations: boolean;
  locations: string[];
  openMode: 'iframe';
  userRole: 'all' | 'admin' | 'user';
  allowCamera: boolean;
  allowMicrophone: boolean;
};

export const createLeadConnectorCustomMenu = (input: {
  embedUrl: string;
  locationId: string;
}): LeadConnectorCustomMenu => {
  const embedUrl = new URL(input.embedUrl);
  if (embedUrl.protocol !== 'https:') {
    throw new Error('LeadConnector embed URL must use HTTPS');
  }
  const locationId = input.locationId.trim();
  if (!locationId)
    throw new Error('LeadConnector sandbox location is required');
  return {
    title: 'Consuelo Dialer',
    url: new URL('/admin', embedUrl).toString(),
    icon: { name: 'phone', fontFamily: 'fas' },
    showOnCompany: false,
    showOnLocation: true,
    showToAllLocations: false,
    locations: [locationId],
    openMode: 'iframe',
    userRole: 'admin',
    allowCamera: false,
    allowMicrophone: true,
  };
};

type CustomMenuSummary = { id: string; title: string };

type CustomMenuListResponse = { customMenus?: CustomMenuSummary[] };

type CustomMenuMutationResponse = { customMenu?: { id?: string } };

export type LeadConnectorDeploymentFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const parseJson = async <T>(response: Response): Promise<T> => {
  const body = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !body) {
    throw new Error(
      `LeadConnector custom menu request failed (${response.status})`,
    );
  }
  return body;
};

export const upsertLeadConnectorSandboxMenu = async (
  input: {
    accessToken: string;
    embedUrl: string;
    locationId: string;
  },
  fetcher: LeadConnectorDeploymentFetch = fetch,
): Promise<{ customMenuId: string; action: 'created' | 'updated' }> => {
  try {
    const accessToken = input.accessToken.trim();
    if (!accessToken)
      throw new Error('LeadConnector sandbox access token is required');
    const menu = createLeadConnectorCustomMenu(input);
    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Version: 'v3',
    };
    const query = new URLSearchParams({
      locationId: input.locationId.trim(),
      query: menu.title,
      limit: '20',
    });
    const listed = await parseJson<CustomMenuListResponse>(
      await fetcher(
        `https://services.leadconnectorhq.com/custom-menus/?${query.toString()}`,
        { headers },
      ),
    );
    const existing = listed.customMenus?.find(
      (candidate) => candidate.title === menu.title,
    );
    const url = existing
      ? `https://services.leadconnectorhq.com/custom-menus/${existing.id}`
      : 'https://services.leadconnectorhq.com/custom-menus/';
    const mutation = await parseJson<CustomMenuMutationResponse>(
      await fetcher(url, {
        method: existing ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(menu),
      }),
    );
    const customMenuId = mutation.customMenu?.id ?? existing?.id;
    if (!customMenuId) {
      throw new Error(
        'LeadConnector custom menu response did not include an ID',
      );
    }
    return {
      customMenuId,
      action: existing ? 'updated' : 'created',
    };
  } catch (cause: unknown) {
    if (cause instanceof Error) throw cause;
    throw new Error('LeadConnector custom menu deployment failed', { cause });
  }
};
