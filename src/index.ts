import * as ldap from 'ldapjs';
import { EventEmitter } from 'events';

export interface ILdapConf {
    url: string;
    base: string;
    bindDN: string;
    bindCredentials: string;
}
export class Ldap {
    private client: ldap.Client;
    constructor(private conf: ILdapConf) {
        this.client = ldap.createClient({ url: conf.url, reconnect: true })
        this.client.on('connect', () => {
            this.client.bind(this.conf.bindDN, this.conf.bindCredentials, err => {
                if (err) {
                    console.error('error while ldap binding' + err);
                }
            });
        });
        this.client.on('error', function(err) {
            console.warn('LDAP connection failed, but fear not, it will reconnect OK', err);
        });
    }    
    private async getSearchEventEmitter(filter: string, attributes?: string[]): Promise<EventEmitter> {
        return new Promise((res, rej) => {
            this.client.search(this.conf.base, { scope: 'sub', filter, attributes }, (e, r) => {
                if (e) {
                    rej(e);
                    return;
                }
                res(r);
            })
        })
    }

    async search(filter: string, attributes?: string[]): Promise<any[]> {
        let events = await this.getSearchEventEmitter(filter, attributes);
        let r: any[] = [];
        return new Promise((resolve, reject) => {
            events.on('searchEntry', (entry) => {
                r.push(this.parseEntry(entry));
            });
            events.once('error', reject);
            events.once('end', () => resolve(r));
        });
    }

    parseEntry(entry: any) {
        let r = Object.assign({}, entry.object);
        entry.attributes.map((e: any) => {
            //console.log(e);
            if (e.type === 'objectGUID') {
                r.objectGUID = this.formatGuid(e.buffers[0]);
            } else if (e.type === 'thumbnailPhoto') {
                r.thumbnailPhoto = e.buffers[0];
            } else if (e.type === 'jpegPhoto') {
                r.jpegPhoto = e.buffers[0];
            }
        });
        return r;
    }

    private formatGuid(data: any) {
        let format = '{3}{2}{1}{0}-{5}{4}-{7}{6}-{8}{9}-{10}{11}{12}{13}{14}{15}';
        for (var i = 0; i < data.length; i++) {
            var re = new RegExp('\\{' + i + '\\}', 'g');
            // Leading 0 is needed if value of data[i] is less than 16 (of 10 as hex). 
            var dataStr = data[i].toString(16);
            format = format.replace(re, data[i] >= 16 ? dataStr : '0' + dataStr);
        }
        return format;
    }
}