// Type definitions for Google API Client

declare namespace gapi {
    namespace client {
        function init(options: {
            apiKey: string;
            discoveryDocs?: string[];
            clientId?: string;
            scope?: string;
        }): Promise<void>;

        function getToken(): { access_token: string } | null;
        function setToken(token: string | null): void;

        namespace drive {
            namespace files {
                function list(options: {
                    q?: string;
                    fields?: string;
                    spaces?: string;
                    pageSize?: number;
                    pageToken?: string;
                }): Promise<{
                    result: {
                        files: Array<{
                            id: string;
                            name: string;
                            mimeType?: string;
                            [key: string]: any;
                        }>;
                        nextPageToken?: string;
                    };
                }>;

                function get(options: {
                    fileId: string;
                    alt?: string;
                    fields?: string;
                }): Promise<{
                    result: any;
                }>;

                function create(options: {
                    resource?: {
                        name: string;
                        mimeType?: string;
                        parents?: string[];
                        [key: string]: any;
                    };
                    media?: {
                        mimeType: string;
                        body: string | object;
                    };
                    fields?: string;
                }): Promise<{
                    result: {
                        id: string;
                        name: string;
                        [key: string]: any;
                    };
                }>;

                function update(options: {
                    fileId: string;
                    resource?: {
                        name?: string;
                        mimeType?: string;
                        [key: string]: any;
                    };
                    media?: {
                        mimeType: string;
                        body: string | object;
                    };
                    fields?: string;
                }): Promise<{
                    result: {
                        id: string;
                        name: string;
                        [key: string]: any;
                    };
                }>;
                
                // Note: The 'delete' method is accessed using bracket notation in the code
                // due to 'delete' being a reserved word
            }
        }
    }

    function load(api: string, callback: () => void): void;
}

declare namespace google {
    namespace accounts {
        namespace oauth2 {
            function initTokenClient(options: {
                client_id: string;
                scope: string;
                callback: string | ((resp: { error?: string; access_token?: string }) => void);
                prompt?: string;
            }): {
                requestAccessToken: (options?: { prompt?: string }) => void;
            };

            function revoke(token: string, callback?: () => void): void;
        }
    }
} 