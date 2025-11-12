import { Module } from '@nestjs/common';

import {
  WinstonModule,
  utilities as nestWinstonModuleUtilities,
} from 'nest-winston';
import * as winston from 'winston';
import { colorize } from 'json-colorizer';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { APP_GUARD } from '@nestjs/core';
import { AtGuard } from './auth/guards';

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
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5400'),
      username: process.env.DB_USER || 'user',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_DATABASE || 'db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
    }),
    AuthModule,
    UserModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AtGuard,
    },
  ],
})
export class AppModule {}
