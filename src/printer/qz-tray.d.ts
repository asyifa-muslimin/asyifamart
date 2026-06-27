// Deklarasi tipe minimal untuk paket `qz-tray`, yang tidak menyertakan
// file .d.ts resmi. Hanya mencakup permukaan API yang dipakai di src/printer/.
declare module 'qz-tray' {
  interface QzConfig {
    [key: string]: any;
  }

  interface QzPrintData {
    type: string;
    format?: string;
    flavor?: string;
    data: string;
    options?: Record<string, any>;
  }

  const qz: {
    websocket: {
      connect: (options?: any) => Promise<void>;
      disconnect: () => Promise<void>;
      isActive: () => boolean;
    };
    security: {
      setCertificatePromise: (
        handler: (resolve: (value: string) => void, reject: (reason?: any) => void) => void,
        options?: { rejectOnFailure?: boolean }
      ) => void;
      setSignaturePromise: (
        factory: (dataToSign: string) => (resolve: (value: string) => void, reject: (reason?: any) => void) => void
      ) => void;
      setSignatureAlgorithm: (algorithm: 'SHA1' | 'SHA256' | 'SHA512') => void;
    };
    printers: {
      find: (query?: string) => Promise<string | string[]>;
      getDefault: () => Promise<string>;
    };
    configs: {
      create: (printer: string, options?: Record<string, any>) => QzConfig;
    };
    print: (config: QzConfig | QzConfig[], data: Array<QzPrintData | string>) => Promise<void>;
  };

  export default qz;
}
