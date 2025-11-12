import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  WinstonModule,
  utilities as nestWinstonModuleUtilities,
} from 'nest-winston';
import * as winston from 'winston';
import { colorize } from 'json-colorizer';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          level: 'debug',
          format: winston.format.combine(
            process.env.NODE_ENV === 'development'
              ? winston.format.colorize()
              : winston.format.json(),
            winston.format.timestamp(),
            winston.format.ms(),
            nestWinstonModuleUtilities.format.nestLike('Backend', {
              colors: true,
              prettyPrint: true,
            }),
            winston.format.printf((info) => {
              if (info.message instanceof Error) {
                return `${info.timestamp} ${info.level}: ${info.message.message}`;
              }
              if (typeof info.message === 'object') {
                return `${info.timestamp} ${info.level}: ${colorize(
                  JSON.stringify(info.message, null, 2),
                )}`;
              }
              return `${info.timestamp} ${info.level}: ${info.message}`;
            }),
          ),
        }),
      ],
    }),
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
