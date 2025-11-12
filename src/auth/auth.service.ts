import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Repository } from 'typeorm';
import { SigninDto, SignupDto } from './dto';
import * as argon from 'argon2';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    private config: ConfigService,
    private jwtService: JwtService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async signup(dto: SignupDto) {
    const { email, password, firstName, lastName } = dto;
    const user = await this.userRepository.findBy({ email });
    if (user.length > 0) {
      this.logger.debug('Account already exists');
      throw new ConflictException(
        'An Account is already registered with the given email. please Log in or register using a different email',
      );
    }

    const passwordHash = await this.hashData(password);

    const newUser = this.userRepository.create({
      email,
      firstName,
      lastName,
      password: passwordHash,
    });
    const savedUser = await this.userRepository.save(newUser);

    if (!savedUser) {
      this.logger.error('Failed to create user', { email });
      throw new ConflictException('Failed to create user');
    }

    this.logger.info('User successfully registered', {
      userId: savedUser.id,
      email,
    });

    const token = await this.generateTokens(
      savedUser.id,
      savedUser.email,
      savedUser.firstName,
      savedUser.lastName,
    );

    return token;
  }

  async signin(dto: SigninDto) {
    const { email, password } = dto;
    const user = await this.userRepository.findBy({ email });
    if (user.length !== 1) {
      this.logger.warn('Signin attempt with non-existent email', { email });
      throw new UnauthorizedException('Incorrect Credentials');
    }

    const pwMatches = await argon.verify(user[0].password, password);
    if (!pwMatches) {
      this.logger.warn('Signin attempt with incorrect password', {
        email,
        userId: user[0].id,
      });
      throw new UnauthorizedException('Incorrect Credentials');
    }

    this.logger.info('User successfully signed in', {
      userId: user[0].id,
      email,
    });

    const token = await this.generateTokens(
      user[0].id,
      user[0].email,
      user[0].firstName,
      user[0].lastName,
    );

    return token;
  }

  async hashData(data: string): Promise<string> {
    return await argon.hash(data);
  }

  async generateTokens(
    userId: string,
    email: string,
    firstName: string,
    lastName: string,
  ) {
    try {
      const at = this.jwtService.sign(
        { sub: userId, email, firstName, lastName },
        {
          secret: this.config.get('AT_SECRET'),
          expiresIn: this.config.get('AT_EXPIRESIN'),
        },
      );

      return { access_token: at };
    } catch (err) {
      this.logger.error('Failed to generate tokens', {
        error: err,
        userId,
        email,
      });
      throw new InternalServerErrorException('Failed to generate tokens');
    }
  }
}
